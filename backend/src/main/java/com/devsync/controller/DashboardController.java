package com.devsync.controller;

import com.devsync.common.result.Result;
import com.devsync.dto.rsp.DashboardRsp;
import com.devsync.service.IDashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 仪表盘控制器
 *
 * @author xiaolei
 */
@Slf4j
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Tag(name = "仪表盘")
public class DashboardController {

    private final IDashboardService dashboardService;

    @GetMapping("/overview")
    @Operation(summary = "获取仪表盘概览数据")
    public Result<DashboardRsp> overview() {
        return Result.success(dashboardService.getOverview());
    }
}
