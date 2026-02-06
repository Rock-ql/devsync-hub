package com.devsync.controller;

import com.devsync.common.result.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 健康检查控制器（用于容器探活）
 *
 * 说明：该接口只用于应用存活检查，不依赖数据库/Redis。
 *
 * @author xiaolei
 */
@RestController
@RequestMapping("/api/health")
@Tag(name = "健康检查")
public class HealthController {

    @GetMapping
    @Operation(summary = "健康检查（不依赖数据库）")
    public Result<String> health() {
        return Result.success("ok");
    }
}

