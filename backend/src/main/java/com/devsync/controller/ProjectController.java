package com.devsync.controller;

import com.devsync.common.result.PageResult;
import com.devsync.common.result.Result;
import com.devsync.dto.req.ProjectAddReq;
import com.devsync.dto.req.ProjectListReq;
import com.devsync.dto.req.ProjectUpdateReq;
import com.devsync.dto.rsp.GitCommitRsp;
import com.devsync.dto.rsp.ProjectRsp;
import com.devsync.service.IProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 项目管理控制器
 *
 * @author xiaolei
 */
@Slf4j
@RestController
@RequestMapping("/api/project")
@RequiredArgsConstructor
@Tag(name = "项目管理")
public class ProjectController {

    private final IProjectService projectService;

    @PostMapping("/list")
    @Operation(summary = "分页查询项目列表")
    public Result<PageResult<ProjectRsp>> list(@Valid @RequestBody ProjectListReq req) {
        return Result.success(projectService.listProjects(req));
    }

    @GetMapping("/all")
    @Operation(summary = "获取所有项目列表（不分页）")
    public Result<List<ProjectRsp>> all() {
        return Result.success(projectService.listAllProjects());
    }

    @GetMapping("/detail/{id}")
    @Operation(summary = "获取项目详情")
    public Result<ProjectRsp> detail(@PathVariable Integer id) {
        return Result.success(projectService.getProjectDetail(id));
    }

    @PostMapping("/add")
    @Operation(summary = "新增项目")
    public Result<Integer> add(@Valid @RequestBody ProjectAddReq req) {
        return Result.success(projectService.addProject(req));
    }

    @PostMapping("/update")
    @Operation(summary = "更新项目")
    public Result<Void> update(@Valid @RequestBody ProjectUpdateReq req) {
        projectService.updateProject(req);
        return Result.success();
    }

    @PostMapping("/delete/{id}")
    @Operation(summary = "删除项目")
    public Result<Void> delete(@PathVariable Integer id) {
        projectService.deleteProject(id);
        return Result.success();
    }

    @PostMapping("/sync-commits/{id}")
    @Operation(summary = "同步GitLab提交记录")
    public Result<Integer> syncCommits(@PathVariable Integer id) {
        return Result.success("同步成功", projectService.syncCommits(id));
    }

    @GetMapping("/commits/{id}")
    @Operation(summary = "获取项目提交记录")
    public Result<List<GitCommitRsp>> getCommits(@PathVariable Integer id) {
        return Result.success(projectService.getCommitsByProjectId(id));
    }
}
