package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson2.JSON;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.client.GitLabClient;
import com.devsync.common.exception.BusinessException;
import com.devsync.common.result.PageResult;
import com.devsync.dto.req.GitLabBranchReq;
import com.devsync.dto.req.ProjectAddReq;
import com.devsync.dto.req.ProjectListReq;
import com.devsync.dto.req.ProjectUpdateReq;
import com.devsync.dto.rsp.GitCommitRsp;
import com.devsync.dto.rsp.GitLabBranchRsp;
import com.devsync.dto.rsp.ProjectRsp;
import com.devsync.entity.GitCommit;
import com.devsync.entity.Project;
import com.devsync.mapper.GitCommitMapper;
import com.devsync.mapper.IterationMapper;
import com.devsync.mapper.PendingSqlMapper;
import com.devsync.mapper.ProjectMapper;
import com.devsync.service.IProjectService;
import com.devsync.service.ISqlEnvConfigService;
import com.devsync.util.EncryptUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 项目服务实现
 *
 * @author xiaolei
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectServiceImpl extends ServiceImpl<ProjectMapper, Project> implements IProjectService {

    private final ProjectMapper projectMapper;
    private final IterationMapper iterationMapper;
    private final PendingSqlMapper pendingSqlMapper;
    private final GitCommitMapper gitCommitMapper;
    private final GitLabClient gitLabClient;
    private final EncryptUtil encryptUtil;
    private final ISqlEnvConfigService sqlEnvConfigService;

    @Override
    public PageResult<ProjectRsp> listProjects(ProjectListReq req) {
        log.info("[项目管理] 分页查询项目列表，参数: name={}, state={}, pageNum={}, pageSize={}",
                req.getName(), req.getState(), req.getPageNum(), req.getPageSize());

        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StrUtil.isNotBlank(req.getName()), Project::getName, req.getName())
                .eq(req.getState() != null, Project::getState, req.getState())
                .orderByDesc(Project::getCreatedAt);

        Page<Project> page = new Page<>(req.getPageNum(), req.getPageSize());
        Page<Project> result = projectMapper.selectPage(page, wrapper);

        List<ProjectRsp> list = result.getRecords().stream()
                .map(this::convertToRsp)
                .collect(Collectors.toList());

        return PageResult.of(list, result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public List<ProjectRsp> listAllProjects() {
        log.info("[项目管理] 获取所有项目列表");

        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Project::getState, 1)
                .orderByDesc(Project::getCreatedAt);

        List<Project> projects = projectMapper.selectList(wrapper);
        return projects.stream()
                .map(this::convertToRsp)
                .collect(Collectors.toList());
    }

    @Override
    public ProjectRsp getProjectDetail(Integer id) {
        log.info("[项目管理] 获取项目详情，ID: {}", id);

        Project project = projectMapper.selectById(id);
        if (project == null) {
            throw new BusinessException(404, "项目不存在");
        }

        return convertToRsp(project);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Integer addProject(ProjectAddReq req) {
        log.info("[项目管理] 新增项目，名称: {}", req.getName());

        // 检查项目名称是否重复
        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Project::getName, req.getName());
        if (projectMapper.selectCount(wrapper) > 0) {
            throw new BusinessException(400, "项目名称已存在");
        }

        Project project = new Project();
        BeanUtil.copyProperties(req, project);

        // 加密 GitLab Token
        if (StrUtil.isNotBlank(req.getGitlabToken())) {
            project.setGitlabToken(encryptUtil.encrypt(req.getGitlabToken()));
        }

        // 设置默认分支
        if (StrUtil.isBlank(project.getGitlabBranch())) {
            project.setGitlabBranch("main");
        }

        projectMapper.insert(project);
        log.info("[项目管理] 新增项目成功，ID: {}", project.getId());

        Integer userId = project.getUserId() == null ? 1 : project.getUserId();
        sqlEnvConfigService.initDefaultEnvs(project.getId(), userId);

        return project.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateProject(ProjectUpdateReq req) {
        log.info("[项目管理] 更新项目，ID: {}", req.getId());

        Project project = projectMapper.selectById(req.getId());
        if (project == null) {
            throw new BusinessException(404, "项目不存在");
        }

        // 检查项目名称是否重复
        if (StrUtil.isNotBlank(req.getName()) && !req.getName().equals(project.getName())) {
            LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Project::getName, req.getName())
                    .ne(Project::getId, req.getId());
            if (projectMapper.selectCount(wrapper) > 0) {
                throw new BusinessException(400, "项目名称已存在");
            }
        }

        // 更新非空字段
        if (StrUtil.isNotBlank(req.getName())) {
            project.setName(req.getName());
        }
        if (req.getDescription() != null) {
            project.setDescription(req.getDescription());
        }
        if (req.getGitlabUrl() != null) {
            project.setGitlabUrl(req.getGitlabUrl());
        }
        if (StrUtil.isNotBlank(req.getGitlabToken())) {
            project.setGitlabToken(encryptUtil.encrypt(req.getGitlabToken()));
        }
        if (req.getGitlabProjectId() != null) {
            project.setGitlabProjectId(req.getGitlabProjectId());
        }
        if (StrUtil.isNotBlank(req.getGitlabBranch())) {
            project.setGitlabBranch(req.getGitlabBranch());
        }
        if (req.getState() != null) {
            project.setState(req.getState());
        }

        projectMapper.updateById(project);
        log.info("[项目管理] 更新项目成功，ID: {}", req.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteProject(Integer id) {
        log.info("[项目管理] 删除项目，ID: {}", id);

        Project project = projectMapper.selectById(id);
        if (project == null) {
            throw new BusinessException(404, "项目不存在");
        }

        projectMapper.deleteById(id);
        log.info("[项目管理] 删除项目成功，ID: {}", id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Integer syncCommits(Integer id) {
        log.info("[项目管理] 同步GitLab提交记录，项目ID: {}", id);

        Project project = projectMapper.selectById(id);
        if (project == null) {
            throw new BusinessException(404, "项目不存在");
        }

        if (StrUtil.isBlank(project.getGitlabUrl()) || StrUtil.isBlank(project.getGitlabToken())) {
            throw new BusinessException(400, "请先配置GitLab信息");
        }

        // 解密 Token
        String token = encryptUtil.decrypt(project.getGitlabToken());

        // 调用 GitLab API 获取提交记录
        List<GitCommit> commits = gitLabClient.getCommits(
                project.getGitlabUrl(),
                token,
                project.getGitlabProjectId(),
                project.getGitlabBranch()
        );

        // 保存提交记录
        int count = 0;
        for (GitCommit commit : commits) {
            commit.setProjectId(id);
            // 使用 ON CONFLICT 处理重复记录
            try {
                gitCommitMapper.insert(commit);
                count++;
            } catch (Exception e) {
                log.debug("[项目管理] 提交记录已存在，跳过: {}", commit.getCommitId());
            }
        }

        log.info("[项目管理] 同步GitLab提交记录完成，项目ID: {}, 新增: {}", id, count);
        return count;
    }

    @Override
    public List<GitCommitRsp> getCommitsByProjectId(Integer id) {
        log.info("[项目管理] 获取项目提交记录，项目ID: {}", id);

        // 验证项目是否存在
        Project project = projectMapper.selectById(id);
        if (project == null) {
            throw new BusinessException(404, "项目不存在");
        }

        // 查询提交记录，按提交时间倒序
        LambdaQueryWrapper<GitCommit> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GitCommit::getProjectId, id)
                .orderByDesc(GitCommit::getCommittedAt);
        List<GitCommit> commits = gitCommitMapper.selectList(wrapper);

        // 转换为响应对象
        return commits.stream()
                .map(commit -> {
                    GitCommitRsp rsp = new GitCommitRsp();
                    BeanUtil.copyProperties(commit, rsp);
                    return rsp;
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<GitLabBranchRsp> listGitlabBranches(GitLabBranchReq req) {
        log.info("[项目管理] 获取GitLab分支列表，URL: {}, 项目ID: {}", req.getGitlabUrl(), req.getGitlabProjectId());

        try {
            List<String> branches = gitLabClient.listBranches(
                    req.getGitlabUrl(),
                    req.getGitlabToken(),
                    req.getGitlabProjectId()
            );

            return branches.stream()
                    .map(name -> {
                        GitLabBranchRsp rsp = new GitLabBranchRsp();
                        rsp.setName(name);
                        return rsp;
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            GitLabBranchReq logReq = new GitLabBranchReq();
            logReq.setGitlabUrl(req.getGitlabUrl());
            logReq.setGitlabProjectId(req.getGitlabProjectId());
            logReq.setGitlabToken(maskToken(req.getGitlabToken()));
            log.error("[项目管理] 获取GitLab分支失败，参数: {}",
                    JSON.toJSONString(logReq), e);
            throw e;
        }
    }

    private String maskToken(String token) {
        if (StrUtil.isBlank(token)) {
            return token;
        }
        if (token.length() <= 8) {
            return "****";
        }
        return token.substring(0, 4) + "****" + token.substring(token.length() - 4);
    }

    /**
     * 转换为响应对象
     */
    private ProjectRsp convertToRsp(Project project) {
        ProjectRsp rsp = new ProjectRsp();
        BeanUtil.copyProperties(project, rsp);

        // 判断是否已配置GitLab
        rsp.setGitlabConfigured(StrUtil.isNotBlank(project.getGitlabUrl())
                && StrUtil.isNotBlank(project.getGitlabToken())
                && project.getGitlabProjectId() != null);

        // 查询迭代数量
        rsp.setIterationCount(iterationMapper.countByProjectId(project.getId()));

        // 查询待执行SQL数量
        rsp.setPendingSqlCount(pendingSqlMapper.countPendingByProjectId(project.getId()));

        return rsp;
    }
}
