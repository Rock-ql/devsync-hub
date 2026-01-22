package com.devsync.controller;

import com.devsync.common.result.PageResult;
import com.devsync.common.result.Result;
import com.devsync.dto.req.*;
import com.devsync.dto.rsp.PendingSqlRsp;
import com.devsync.service.IPendingSqlService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * SQL管理控制器
 *
 * @author xiaolei
 */
@Slf4j
@RestController
@RequestMapping("/api/sql")
@RequiredArgsConstructor
@Tag(name = "SQL管理")
public class PendingSqlController {

    private final IPendingSqlService pendingSqlService;

    @PostMapping("/list")
    @Operation(summary = "分页查询SQL列表")
    public Result<PageResult<PendingSqlRsp>> list(@Valid @RequestBody PendingSqlListReq req) {
        return Result.success(pendingSqlService.listSql(req));
    }

    @GetMapping("/detail/{id}")
    @Operation(summary = "获取SQL详情")
    public Result<PendingSqlRsp> detail(@PathVariable Integer id) {
        return Result.success(pendingSqlService.getSqlDetail(id));
    }

    @GetMapping("/pending/{projectId}")
    @Operation(summary = "获取项目的待执行SQL列表")
    public Result<List<PendingSqlRsp>> listPending(@PathVariable Integer projectId) {
        return Result.success(pendingSqlService.listPendingByProject(projectId));
    }

    @PostMapping("/add")
    @Operation(summary = "新增SQL")
    public Result<Integer> add(@Valid @RequestBody PendingSqlAddReq req) {
        return Result.success(pendingSqlService.addSql(req));
    }

    @PostMapping("/update")
    @Operation(summary = "更新SQL")
    public Result<Void> update(@Valid @RequestBody PendingSqlUpdateReq req) {
        pendingSqlService.updateSql(req);
        return Result.success();
    }

    @PostMapping("/delete/{id}")
    @Operation(summary = "删除SQL")
    public Result<Void> delete(@PathVariable Integer id) {
        pendingSqlService.deleteSql(id);
        return Result.success();
    }

    @PostMapping("/execute")
    @Operation(summary = "标记SQL为已执行")
    public Result<Void> execute(@Valid @RequestBody PendingSqlExecuteReq req) {
        pendingSqlService.executeSql(req);
        return Result.success();
    }

    @PostMapping("/batch-execute")
    @Operation(summary = "批量标记SQL为已执行")
    public Result<Void> batchExecute(@Valid @RequestBody PendingSqlBatchExecuteReq req) {
        pendingSqlService.batchExecuteSql(req);
        return Result.success();
    }
}
