package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.TypeReference;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.client.DeepSeekClient;
import com.devsync.client.GitLabClient;
import com.devsync.common.enums.ReportTypeEnum;
import com.devsync.common.exception.BusinessException;
import com.devsync.common.result.PageResult;
import com.devsync.dto.req.ReportGenerateReq;
import com.devsync.dto.req.ReportListReq;
import com.devsync.dto.req.ReportUpdateReq;
import com.devsync.dto.rsp.ReportRsp;
import com.devsync.entity.GitCommit;
import com.devsync.entity.Project;
import com.devsync.entity.Report;
import com.devsync.entity.ReportTemplate;
import com.devsync.mapper.GitCommitMapper;
import com.devsync.mapper.ProjectMapper;
import com.devsync.mapper.ReportMapper;
import com.devsync.mapper.ReportTemplateMapper;
import com.devsync.service.IReportService;
import com.devsync.util.EncryptUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 报告服务实现
 *
 * @author xiaolei
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportServiceImpl extends ServiceImpl<ReportMapper, Report> implements IReportService {

    private final ReportMapper reportMapper;
    private final ReportTemplateMapper reportTemplateMapper;
    private final ProjectMapper projectMapper;
    private final GitCommitMapper gitCommitMapper;
    private final GitLabClient gitLabClient;
    private final DeepSeekClient deepSeekClient;
    private final EncryptUtil encryptUtil;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReportRsp generateReport(ReportGenerateReq req) {
        log.info("[报告生成] 开始生成报告，类型: {}, 日期范围: {} - {}",
                req.getType(), req.getStartDate(), req.getEndDate());

        // 验证报告类型
        ReportTypeEnum reportType = ReportTypeEnum.getByCode(req.getType());
        if (reportType == null) {
            throw new BusinessException(400, "无效的报告类型");
        }

        // 获取模板
        ReportTemplate template;
        if (req.getTemplateId() != null) {
            template = reportTemplateMapper.selectById(req.getTemplateId());
            if (template == null) {
                throw new BusinessException(404, "模板不存在");
            }
        } else {
            template = reportTemplateMapper.getDefaultTemplate(req.getType());
            if (template == null) {
                throw new BusinessException(404, "未找到默认模板");
            }
        }

        // 获取所有项目的提交记录
        LocalDateTime startTime = req.getStartDate().atStartOfDay();
        LocalDateTime endTime = req.getEndDate().atTime(LocalTime.MAX);

        List<GitCommit> allCommits = gitCommitMapper.selectAllByTimeRange(startTime, endTime);

        // 如果缓存中没有提交记录，尝试从 GitLab 同步
        if (allCommits.isEmpty()) {
            log.info("[报告生成] 缓存中无提交记录，尝试从GitLab同步");
            syncAllProjectCommits(startTime, endTime);
            allCommits = gitCommitMapper.selectAllByTimeRange(startTime, endTime);
        }

        // 格式化提交记录
        String commitsText = formatCommits(allCommits);

        // 调用AI生成报告
        String content;
        try {
            content = deepSeekClient.generateReport(commitsText, template.getContent(), req.getType());
        } catch (Exception e) {
            log.error("[报告生成] AI生成失败，使用模板内容", e);
            // AI生成失败时，使用简单替换
            content = template.getContent().replace("{{commits}}", commitsText);
        }

        // 生成标题
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        String title = reportType.getDesc() + " - " + req.getStartDate().format(formatter);
        if (!req.getStartDate().equals(req.getEndDate())) {
            title += " ~ " + req.getEndDate().format(formatter);
        }

        // 保存报告
        Report report = new Report();
        report.setType(req.getType());
        report.setTitle(title);
        report.setContent(content);
        report.setStartDate(req.getStartDate());
        report.setEndDate(req.getEndDate());

        // 保存提交摘要
        Map<String, Object> summary = new HashMap<>();
        summary.put("totalCommits", allCommits.size());
        summary.put("projects", allCommits.stream()
                .map(GitCommit::getProjectId)
                .distinct()
                .count());
        report.setCommitSummary(JSON.toJSONString(summary));

        reportMapper.insert(report);
        log.info("[报告生成] 报告生成成功，ID: {}", report.getId());

        return convertToRsp(report);
    }

    @Override
    public PageResult<ReportRsp> listReports(ReportListReq req) {
        log.info("[报告管理] 分页查询报告列表，类型: {}", req.getType());

        LambdaQueryWrapper<Report> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(StrUtil.isNotBlank(req.getType()), Report::getType, req.getType())
                .orderByDesc(Report::getCreatedAt);

        Page<Report> page = new Page<>(req.getPageNum(), req.getPageSize());
        Page<Report> result = reportMapper.selectPage(page, wrapper);

        List<ReportRsp> list = result.getRecords().stream()
                .map(this::convertToRsp)
                .collect(Collectors.toList());

        return PageResult.of(list, result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public ReportRsp getReportDetail(Integer id) {
        log.info("[报告管理] 获取报告详情，ID: {}", id);

        Report report = reportMapper.selectById(id);
        if (report == null) {
            throw new BusinessException(404, "报告不存在");
        }

        return convertToRsp(report);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateReport(ReportUpdateReq req) {
        log.info("[报告管理] 更新报告，ID: {}", req.getId());

        Report report = reportMapper.selectById(req.getId());
        if (report == null) {
            throw new BusinessException(404, "报告不存在");
        }

        if (StrUtil.isNotBlank(req.getTitle())) {
            report.setTitle(req.getTitle());
        }
        if (StrUtil.isNotBlank(req.getContent())) {
            report.setContent(req.getContent());
        }

        reportMapper.updateById(report);
        log.info("[报告管理] 更新报告成功，ID: {}", req.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteReport(Integer id) {
        log.info("[报告管理] 删除报告，ID: {}", id);

        Report report = reportMapper.selectById(id);
        if (report == null) {
            throw new BusinessException(404, "报告不存在");
        }

        reportMapper.deleteById(id);
        log.info("[报告管理] 删除报告成功，ID: {}", id);
    }

    /**
     * 同步所有项目的提交记录
     */
    private void syncAllProjectCommits(LocalDateTime startTime, LocalDateTime endTime) {
        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Project::getState, 1);
        List<Project> projects = projectMapper.selectList(wrapper);

        for (Project project : projects) {
            if (StrUtil.isBlank(project.getGitlabUrl()) || StrUtil.isBlank(project.getGitlabToken())) {
                continue;
            }

            try {
                String token = encryptUtil.decrypt(project.getGitlabToken());
                List<GitCommit> commits = gitLabClient.getCommitsByTimeRange(
                        project.getGitlabUrl(),
                        token,
                        project.getGitlabProjectId(),
                        project.getGitlabBranch(),
                        startTime,
                        endTime
                );

                for (GitCommit commit : commits) {
                    commit.setProjectId(project.getId());
                    try {
                        gitCommitMapper.insert(commit);
                    } catch (Exception e) {
                        log.debug("[报告生成] 提交记录已存在，跳过: {}", commit.getCommitId());
                    }
                }
            } catch (Exception e) {
                log.error("[报告生成] 同步项目提交记录失败，项目: {}", project.getName(), e);
            }
        }
    }

    /**
     * 格式化提交记录
     */
    private String formatCommits(List<GitCommit> commits) {
        if (commits.isEmpty()) {
            return "暂无提交记录";
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        StringBuilder sb = new StringBuilder();

        for (GitCommit commit : commits) {
            sb.append("- [").append(commit.getCommittedAt().format(formatter)).append("] ");
            sb.append(commit.getMessage());
            if (StrUtil.isNotBlank(commit.getAuthorName())) {
                sb.append(" (").append(commit.getAuthorName()).append(")");
            }
            sb.append("\n");
        }

        return sb.toString();
    }

    /**
     * 转换为响应对象
     */
    private ReportRsp convertToRsp(Report report) {
        ReportRsp rsp = new ReportRsp();
        BeanUtil.copyProperties(report, rsp, "commitSummary");

        // 手动处理 commitSummary 字段（从 JSON 字符串转换为 Map）
        if (StrUtil.isNotBlank(report.getCommitSummary())) {
            try {
                Map<String, Object> summaryMap = JSON.parseObject(report.getCommitSummary(),
                        new TypeReference<Map<String, Object>>() {});
                rsp.setCommitSummary(summaryMap);
            } catch (Exception e) {
                log.warn("[报告管理] 解析提交摘要失败，ID: {}", report.getId(), e);
                rsp.setCommitSummary(new HashMap<>());
            }
        }

        // 获取类型描述
        ReportTypeEnum typeEnum = ReportTypeEnum.getByCode(report.getType());
        if (typeEnum != null) {
            rsp.setTypeDesc(typeEnum.getDesc());
        }

        return rsp;
    }
}
