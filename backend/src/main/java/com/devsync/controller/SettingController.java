package com.devsync.controller;

import com.devsync.common.result.Result;
import com.devsync.dto.req.SettingUpdateReq;
import com.devsync.service.ISystemSettingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 系统设置控制器
 *
 * @author xiaolei
 */
@Slf4j
@RestController
@RequestMapping("/api/setting")
@RequiredArgsConstructor
@Tag(name = "系统设置")
public class SettingController {

    private final ISystemSettingService systemSettingService;

    @GetMapping("/all")
    @Operation(summary = "获取所有设置")
    public Result<Map<String, String>> getAll() {
        return Result.success(systemSettingService.getAllSettings());
    }

    @GetMapping("/{key}")
    @Operation(summary = "获取单个设置")
    public Result<String> get(@PathVariable String key) {
        return Result.success(systemSettingService.getSetting(key));
    }

    @PostMapping("/update")
    @Operation(summary = "更新设置")
    public Result<Void> update(@Valid @RequestBody SettingUpdateReq req) {
        systemSettingService.updateSetting(req);
        return Result.success();
    }

    @PostMapping("/batch-update")
    @Operation(summary = "批量更新设置")
    public Result<Void> batchUpdate(@RequestBody Map<String, String> settings) {
        systemSettingService.batchUpdateSettings(settings);
        return Result.success();
    }
}
