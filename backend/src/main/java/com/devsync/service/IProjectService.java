package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.common.result.PageResult;
import com.devsync.dto.req.ProjectAddReq;
import com.devsync.dto.req.ProjectListReq;
import com.devsync.dto.req.ProjectUpdateReq;
import com.devsync.dto.rsp.GitCommitRsp;
import com.devsync.dto.rsp.ProjectRsp;
import com.devsync.entity.Project;

import java.util.List;

/**
 * 项目服务接口
 *
 * @author xiaolei
 */
public interface IProjectService extends IService<Project> {

    /**
     * 分页查询项目列表
     *
     * @param req 查询条件
     * @return 分页结果
     */
    PageResult<ProjectRsp> listProjects(ProjectListReq req);

    /**
     * 获取所有项目列表（不分页）
     *
     * @return 项目列表
     */
    List<ProjectRsp> listAllProjects();

    /**
     * 获取项目详情
     *
     * @param id 项目ID
     * @return 项目详情
     */
    ProjectRsp getProjectDetail(Integer id);

    /**
     * 新增项目
     *
     * @param req 新增请求
     * @return 项目ID
     */
    Integer addProject(ProjectAddReq req);

    /**
     * 更新项目
     *
     * @param req 更新请求
     */
    void updateProject(ProjectUpdateReq req);

    /**
     * 删除项目
     *
     * @param id 项目ID
     */
    void deleteProject(Integer id);

    /**
     * 同步GitLab提交记录
     *
     * @param id 项目ID
     * @return 同步的提交数量
     */
    Integer syncCommits(Integer id);

    /**
     * 获取项目提交记录
     *
     * @param id 项目ID
     * @return 提交记录列表
     */
    List<GitCommitRsp> getCommitsByProjectId(Integer id);
}
