package com.devsync.controller;

import com.devsync.common.result.PageResult;
import com.devsync.common.result.Result;
import com.devsync.dto.req.IterationAddReq;
import com.devsync.dto.req.IterationListReq;
import com.devsync.dto.req.IterationUpdateReq;
import com.devsync.dto.rsp.IterationRsp;
import com.devsync.service.IIterationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 迭代管理控制器
 *
 * @author xiaolei
 */
@Slf4j
@RestController
@RequestMapping("/api/iteration")
@RequiredArgsConstructor
@Tag(name = "迭代管理")
public class IterationController {

    private final IIterationService iterationService;

    @PostMapping("/list")
    @Operation(summary = "分页查询迭代列表")
    public Result<PageResult<IterationRsp>> list(@Valid @RequestBody IterationListReq req) {
        return Result.success(iterationService.listIterations(req));
    }

    @GetMapping("/project/{projectId}")
    @Operation(summary = "获取项目的所有迭代")
    public Result<List<IterationRsp>> listByProject(@PathVariable Integer projectId) {
        return Result.success(iterationService.listByProject(projectId));
    }

    @GetMapping("/detail/{id}")
    @Operation(summary = "获取迭代详情")
    public Result<IterationRsp> detail(@PathVariable Integer id) {
        return Result.success(iterationService.getIterationDetail(id));
    }

    @PostMapping("/add")
    @Operation(summary = "新增迭代")
    public Result<Integer> add(@Valid @RequestBody IterationAddReq req) {
        return Result.success(iterationService.addIteration(req));
    }

    @PostMapping("/update")
    @Operation(summary = "更新迭代")
    public Result<Void> update(@Valid @RequestBody IterationUpdateReq req) {
        iterationService.updateIteration(req);
        return Result.success();
    }

    @PostMapping("/delete/{id}")
    @Operation(summary = "删除迭代")
    public Result<Void> delete(@PathVariable Integer id) {
        iterationService.deleteIteration(id);
        return Result.success();
    }

    @PostMapping("/status/{id}/{status}")
    @Operation(summary = "更新迭代状态")
    public Result<Void> updateStatus(@PathVariable Integer id, @PathVariable String status) {
        iterationService.updateStatus(id, status);
        return Result.success();
    }
}
