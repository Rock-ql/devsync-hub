package com.devsync.controller;

import com.devsync.common.result.Result;
import com.devsync.dto.req.ApiKeyCreateReq;
import com.devsync.dto.rsp.ApiKeyRsp;
import com.devsync.service.IApiKeyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API Key管理控制器
 *
 * @author xiaolei
 */
@Slf4j
@RestController
@RequestMapping("/api/apikey")
@RequiredArgsConstructor
@Tag(name = "API Key管理")
public class ApiKeyController {

    private final IApiKeyService apiKeyService;

    @GetMapping("/list")
    @Operation(summary = "获取API Key列表")
    public Result<List<ApiKeyRsp>> list() {
        return Result.success(apiKeyService.listApiKeys());
    }

    @PostMapping("/create")
    @Operation(summary = "创建API Key")
    public Result<ApiKeyRsp> create(@Valid @RequestBody ApiKeyCreateReq req) {
        return Result.success(apiKeyService.createApiKey(req));
    }

    @PostMapping("/delete/{id}")
    @Operation(summary = "删除API Key")
    public Result<Void> delete(@PathVariable Integer id) {
        apiKeyService.deleteApiKey(id);
        return Result.success();
    }
}
