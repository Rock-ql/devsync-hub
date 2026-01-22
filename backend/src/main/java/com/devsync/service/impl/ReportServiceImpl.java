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
import com.devsync.service.ISystemSettingService;
import com.devsync.util.EncryptUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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
    private final ISystemSettingService systemSettingService;
    private final EncryptUtil encryptUtil;

    private static final String DAILY_TEMPLATE_KEY = "report.template.daily";
    private static final String WEEKLY_TEMPLATE_KEY = "report.template.weekly";

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

        String settingTemplate = getSettingTemplate(req.getType());
        boolean useSettingTemplate = StrUtil.isNotBlank(settingTemplate);
        String templateContent = useSettingTemplate ? settingTemplate : template.getContent();

        TemplateRule rule = parseTemplateRule(templateContent);
        String commitsText = buildCommitSummary(allCommits, rule);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        String defaultTitle = reportType.getDesc() + " - " + req.getStartDate().format(formatter);
        if (!req.getStartDate().equals(req.getEndDate())) {
            defaultTitle += " ~ " + req.getEndDate().format(formatter);
        }

        String title = useSettingTemplate
                ? resolveTitle(templateContent, defaultTitle, req)
                : defaultTitle;

        String content;
        if (useSettingTemplate) {
            content = renderTemplate(templateContent, req, commitsText, title);
        } else {
            try {
                content = deepSeekClient.generateReport(commitsText, templateContent, req.getType());
            } catch (Exception e) {
                log.error("[报告生成] AI生成失败，使用模板内容", e);
                content = renderTemplate(templateContent, req, commitsText, title);
            }
            if (StrUtil.isBlank(content)) {
                content = renderTemplate(templateContent, req, commitsText, title);
            }
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

    private String getSettingTemplate(String type) {
        if ("daily".equals(type)) {
            return systemSettingService.getSetting(DAILY_TEMPLATE_KEY);
        }
        if ("weekly".equals(type)) {
            return systemSettingService.getSetting(WEEKLY_TEMPLATE_KEY);
        }
        return null;
    }

    private TemplateRule parseTemplateRule(String template) {
        String content = StrUtil.blankToDefault(template, "");
        boolean groupByProject = containsAny(content, "按项目", "项目归类", "项目分类", "项目分组", "项目维度");
        boolean numbered = containsAny(content, "序号", "编号", "编号列表", "序号列表");
        boolean brief = containsAny(content, "简要", "概要", "概述", "摘要", "简述");
        boolean detailed = containsAny(content, "详细", "明细", "详情");
        if (brief) {
            detailed = false;
        }
        if (!brief && !detailed) {
            detailed = true;
        }
        return new TemplateRule(groupByProject, numbered, detailed);
    }

    private String buildCommitSummary(List<GitCommit> commits, TemplateRule rule) {
        if (commits.isEmpty()) {
            return "暂无提交记录";
        }

        Map<Integer, String> projectNameMap = loadProjectNameMap(commits);
        if (rule.groupByProject) {
            return renderGrouped(commits, projectNameMap, rule);
        }
        return renderFlat(commits, rule);
    }

    private Map<Integer, String> loadProjectNameMap(List<GitCommit> commits) {
        Set<Integer> projectIds = commits.stream()
                .map(GitCommit::getProjectId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (projectIds.isEmpty()) {
            return new HashMap<>();
        }

        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(Project::getId, projectIds);
        List<Project> projects = projectMapper.selectList(wrapper);

        Map<Integer, String> result = new HashMap<>();
        for (Project project : projects) {
            result.put(project.getId(), project.getName());
        }
        return result;
    }

    private String renderGrouped(List<GitCommit> commits, Map<Integer, String> projectNameMap, TemplateRule rule) {
        Map<Integer, List<GitCommit>> grouped = new LinkedHashMap<>();
        for (GitCommit commit : commits) {
            Integer projectId = commit.getProjectId() != null ? commit.getProjectId() : 0;
            grouped.computeIfAbsent(projectId, key -> new java.util.ArrayList<>()).add(commit);
        }

        StringBuilder sb = new StringBuilder();
        for (Map.Entry<Integer, List<GitCommit>> entry : grouped.entrySet()) {
            Integer projectId = entry.getKey();
            String projectName = projectNameMap.getOrDefault(projectId, projectId == 0 ? "未关联项目" : "项目 " + projectId);
            sb.append("### 项目：").append(projectName).append("\n");
            appendCommitLines(sb, entry.getValue(), rule);
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    private String renderFlat(List<GitCommit> commits, TemplateRule rule) {
        StringBuilder sb = new StringBuilder();
        appendCommitLines(sb, commits, rule);
        return sb.toString().trim();
    }

    private void appendCommitLines(StringBuilder sb, List<GitCommit> commits, TemplateRule rule) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        int index = 1;
        for (GitCommit commit : commits) {
            String message = StrUtil.blankToDefault(commit.getMessage(), "无提交信息");
            String line = message;
            if (rule.detailed) {
                String author = StrUtil.blankToDefault(commit.getAuthorName(), "");
                String authorPart = StrUtil.isNotBlank(author) ? "（" + author + "）" : "";
                if (commit.getCommittedAt() != null) {
                    line = "[" + commit.getCommittedAt().format(formatter) + "] " + line + authorPart;
                } else {
                    line = line + authorPart;
                }
            }

            if (rule.numbered) {
                sb.append(index).append(". ").append(line).append("\n");
            } else {
                sb.append("- ").append(line).append("\n");
            }
            index++;
        }
    }

    private String renderTemplate(String template, ReportGenerateReq req, String commitsText, String title) {
        String content = StrUtil.blankToDefault(template, "");
        String date = req.getStartDate() != null ? req.getStartDate().toString() : "";
        String startDate = req.getStartDate() != null ? req.getStartDate().toString() : "";
        String endDate = req.getEndDate() != null ? req.getEndDate().toString() : "";

        content = content.replace("{{commits}}", commitsText);
        content = content.replace("{commits}", commitsText);
        content = content.replace("{{date}}", date);
        content = content.replace("{date}", date);
        content = content.replace("{{startDate}}", startDate);
        content = content.replace("{startDate}", startDate);
        content = content.replace("{{endDate}}", endDate);
        content = content.replace("{endDate}", endDate);
        content = content.replace("{{title}}", title);
        content = content.replace("{title}", title);
        return content;
    }

    private String resolveTitle(String template, String defaultTitle, ReportGenerateReq req) {
        String rendered = renderTemplate(template, req, "", defaultTitle);
        String titleLine = findTitleLine(rendered);
        if (StrUtil.isNotBlank(titleLine)) {
            return titleLine;
        }
        String firstLine = firstNonEmptyLine(rendered);
        if (firstLine.startsWith("# ")) {
            return firstLine.substring(2).trim();
        }
        return defaultTitle;
    }

    private String firstNonEmptyLine(String content) {
        if (StrUtil.isBlank(content)) {
            return "";
        }
        String[] lines = content.split("\n");
        for (String line : lines) {
            if (StrUtil.isNotBlank(line)) {
                return line.trim();
            }
        }
        return "";
    }

    private String findTitleLine(String content) {
        if (StrUtil.isBlank(content)) {
            return "";
        }
        String[] lines = content.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (StrUtil.isBlank(trimmed)) {
                continue;
            }
            if (trimmed.startsWith("标题:") || trimmed.startsWith("标题：")) {
                return trimmed.substring(3).trim();
            }
        }
        return "";
    }

    private boolean containsAny(String content, String... keywords) {
        for (String keyword : keywords) {
            if (content.contains(keyword)) {
                return true;
            }
        }
        return false;
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

    private static class TemplateRule {
        private final boolean groupByProject;
        private final boolean numbered;
        private final boolean detailed;

        private TemplateRule(boolean groupByProject, boolean numbered, boolean detailed) {
            this.groupByProject = groupByProject;
            this.numbered = numbered;
            this.detailed = detailed;
        }
    }
}
