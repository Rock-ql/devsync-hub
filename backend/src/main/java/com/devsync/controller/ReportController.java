package com.devsync.controller;

import com.devsync.common.result.PageResult;
import com.devsync.common.result.Result;
import com.devsync.dto.req.ReportGenerateReq;
import com.devsync.dto.req.ReportListReq;
import com.devsync.dto.req.ReportUpdateReq;
import com.devsync.dto.rsp.ReportRsp;
import com.devsync.service.IReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 报告管理控制器
 *
 * @author xiaolei
 */
@Slf4j
@RestController
@RequestMapping("/api/report")
@RequiredArgsConstructor
@Tag(name = "报告管理")
public class ReportController {

    private final IReportService reportService;

    @PostMapping("/generate")
    @Operation(summary = "生成报告")
    public Result<ReportRsp> generate(@Valid @RequestBody ReportGenerateReq req) {
        return Result.success(reportService.generateReport(req));
    }

    @PostMapping("/list")
    @Operation(summary = "分页查询报告列表")
    public Result<PageResult<ReportRsp>> list(@Valid @RequestBody ReportListReq req) {
        return Result.success(reportService.listReports(req));
    }

    @GetMapping("/detail/{id}")
    @Operation(summary = "获取报告详情")
    public Result<ReportRsp> detail(@PathVariable Integer id) {
        return Result.success(reportService.getReportDetail(id));
    }

    @PostMapping("/update")
    @Operation(summary = "更新报告")
    public Result<Void> update(@Valid @RequestBody ReportUpdateReq req) {
        reportService.updateReport(req);
        return Result.success();
    }

    @PostMapping("/delete/{id}")
    @Operation(summary = "删除报告")
    public Result<Void> delete(@PathVariable Integer id) {
        reportService.deleteReport(id);
        return Result.success();
    }
}
