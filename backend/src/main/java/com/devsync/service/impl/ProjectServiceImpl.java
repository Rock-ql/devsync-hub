package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.StrUtil;
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
import com.devsync.service.ISystemSettingService;
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
    private final ISystemSettingService systemSettingService;

    private static final String GIT_GITLAB_TOKEN_KEY = "git.gitlab.token";

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

        boolean globalGitlabTokenConfigured = hasGlobalGitlabTokenConfigured();

        List<ProjectRsp> list = result.getRecords().stream()
                .map(project -> convertToRsp(project, globalGitlabTokenConfigured))
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
        boolean globalGitlabTokenConfigured = hasGlobalGitlabTokenConfigured();
        return projects.stream()
                .map(project -> convertToRsp(project, globalGitlabTokenConfigured))
                .collect(Collectors.toList());
    }

    @Override
    public ProjectRsp getProjectDetail(Integer id) {
        log.info("[项目管理] 获取项目详情，ID: {}", id);

        Project project = projectMapper.selectById(id);
        if (project == null) {
            throw new BusinessException(404, "项目不存在");
        }

        return convertToRsp(project, hasGlobalGitlabTokenConfigured());
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

        String gitlabToken = StrUtil.isNotBlank(req.getGitlabToken())
                ? req.getGitlabToken()
                : resolveGitlabToken(project);

        // 如果未指定分支且配置了GitLab信息，尝试从远程获取默认分支
        if (StrUtil.isBlank(project.getGitlabBranch())
                && StrUtil.isNotBlank(req.getGitlabUrl())
                && StrUtil.isNotBlank(gitlabToken)) {
            try {
                List<GitLabClient.BranchInfo> branches = gitLabClient.listBranches(
                        req.getGitlabUrl(), gitlabToken, req.getGitlabProjectId());
                branches.stream()
                        .filter(GitLabClient.BranchInfo::isDefaultBranch)
                        .findFirst()
                        .ifPresent(info -> project.setGitlabBranch(info.getName()));
            } catch (Exception e) {
                log.warn("[项目管理] 自动获取默认分支失败，URL: {}，将保留空值", req.getGitlabUrl(), e);
            }
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
        log.info("[项目管理] 同步GitLab提交记录（全分支），项目ID: {}", id);

        Project project = projectMapper.selectById(id);
        if (project == null) {
            throw new BusinessException(404, "项目不存在");
        }

        String token = resolveGitlabToken(project);
        if (StrUtil.isBlank(project.getGitlabUrl()) || StrUtil.isBlank(token)) {
            throw new BusinessException(400, "请先配置GitLab信息");
        }

        // 调用 GitLab API 获取所有分支的提交记录
        List<GitCommit> commits = gitLabClient.getCommitsAllBranches(
                project.getGitlabUrl(),
                token,
                project.getGitlabProjectId()
        );

        // 保存提交记录
        int count = 0;
        for (GitCommit commit : commits) {
            commit.setProjectId(id);
            // 使用 ON CONFLICT 处理重复记录
            int affected = gitCommitMapper.insertIgnoreConflict(commit);
            if (affected == 1) {
                count++;
            } else {
                gitCommitMapper.mergeBranch(id, commit.getCommitId(), commit.getBranch());
                log.debug("[项目管理] 提交记录已存在，跳过: {}", commit.getCommitId());
            }
        }

        log.info("[项目管理] 同步GitLab提交记录完成（全分支），项目ID: {}, 新增: {}", id, count);
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
        log.info("[项目管理] 获取GitLab分支列表，URL: {}, 项目ID: {}, DevSync项目ID: {}",
                req.getGitlabUrl(), req.getGitlabProjectId(), req.getId());

        String gitlabUrl = req.getGitlabUrl();
        String gitlabToken = req.getGitlabToken();
        Integer gitlabProjectId = req.getGitlabProjectId();

        // 编辑模式：前端未传 Token 但传了项目 ID，从数据库获取已存储的 Token
        if (StrUtil.isBlank(gitlabToken) && req.getId() != null) {
            Project project = projectMapper.selectById(req.getId());
            if (project == null) {
                throw new BusinessException(404, "项目不存在");
            }
            if (StrUtil.isNotBlank(project.getGitlabToken())) {
                gitlabToken = decryptToken(project.getGitlabToken());
            }
            // 如果前端也未传 URL 或 GitLab 项目ID，从数据库补充
            if (StrUtil.isBlank(gitlabUrl)) {
                gitlabUrl = project.getGitlabUrl();
            }
            if (gitlabProjectId == null) {
                gitlabProjectId = project.getGitlabProjectId();
            }
        }

        // 回退：使用全局 GitLab Token
        if (StrUtil.isBlank(gitlabToken)) {
            gitlabToken = resolveGlobalGitlabToken();
        }

        // 最终校验：URL 和 Token 必须都有值
        if (StrUtil.isBlank(gitlabUrl)) {
            throw new BusinessException(400, "GitLab 仓库地址不能为空");
        }
        if (StrUtil.isBlank(gitlabToken)) {
            throw new BusinessException(400, "GitLab Token 不能为空，请输入 Token 或在设置页配置全局 Token");
        }

        try {
            List<GitLabClient.BranchInfo> branches = gitLabClient.listBranches(
                    gitlabUrl, gitlabToken, gitlabProjectId);

            return branches.stream()
                    .map(info -> {
                        GitLabBranchRsp rsp = new GitLabBranchRsp();
                        rsp.setName(info.getName());
                        rsp.setDefaultBranch(info.isDefaultBranch());
                        return rsp;
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("[项目管理] 获取GitLab分支失败，URL: {}, gitlabProjectId: {}, devSyncProjectId: {}",
                    gitlabUrl, gitlabProjectId, req.getId(), e);
            throw e;
        }
    }

    /**
     * 转换为响应对象
     */
    private ProjectRsp convertToRsp(Project project, boolean globalGitlabTokenConfigured) {
        ProjectRsp rsp = new ProjectRsp();
        BeanUtil.copyProperties(project, rsp);

        // 判断是否已配置GitLab
        rsp.setGitlabConfigured(StrUtil.isNotBlank(project.getGitlabUrl())
                && (StrUtil.isNotBlank(project.getGitlabToken()) || globalGitlabTokenConfigured)
                && project.getGitlabProjectId() != null);

        // 查询迭代数量
        rsp.setIterationCount(iterationMapper.countByProjectId(project.getId()));

        // 查询待执行SQL数量
        rsp.setPendingSqlCount(pendingSqlMapper.countPendingByProjectId(project.getId()));

        return rsp;
    }

    private String resolveGitlabToken(Project project) {
        if (project == null) {
            return resolveGlobalGitlabToken();
        }
        if (StrUtil.isNotBlank(project.getGitlabToken())) {
            return decryptToken(project.getGitlabToken());
        }
        return resolveGlobalGitlabToken();
    }

    private String resolveGlobalGitlabToken() {
        String globalEncryptedToken = systemSettingService.getSetting(GIT_GITLAB_TOKEN_KEY);
        if (StrUtil.isBlank(globalEncryptedToken)) {
            return null;
        }
        return decryptToken(globalEncryptedToken);
    }

    private String decryptToken(String encryptedToken) {
        if (StrUtil.isBlank(encryptedToken)) {
            return null;
        }
        try {
            return encryptUtil.decrypt(encryptedToken);
        } catch (Exception e) {
            log.error("[项目管理] GitLab Token 解密失败", e);
            throw new BusinessException(500, "GitLab Token 解析失败，请重新配置");
        }
    }

    private boolean hasGlobalGitlabTokenConfigured() {
        return StrUtil.isNotBlank(systemSettingService.getSetting(GIT_GITLAB_TOKEN_KEY));
    }
}
