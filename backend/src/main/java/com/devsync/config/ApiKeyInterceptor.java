package com.devsync.config;

import com.alibaba.fastjson2.JSON;
import com.devsync.common.result.Result;
import com.devsync.service.IApiKeyService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;

/**
 * API Key认证拦截器
 *
 * @author xiaolei
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApiKeyInterceptor implements HandlerInterceptor {

    private final IApiKeyService apiKeyService;

    @Value("${devsync.api-key.header-name:X-API-Key}")
    private String headerName;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 获取API Key
        String apiKey = request.getHeader(headerName);

        // 如果没有提供API Key，允许访问（前端页面访问）
        // 实际生产环境可以根据需要调整策略
        if (apiKey == null || apiKey.isEmpty()) {
            return true;
        }

        // 验证API Key
        if (!apiKeyService.validateApiKey(apiKey)) {
            log.warn("[API Key认证] 认证失败，无效的API Key: {}", maskKey(apiKey));
            writeError(response, "无效的API Key");
            return false;
        }

        // 异步更新最后使用时间
        apiKeyService.updateLastUsedTime(apiKey);

        return true;
    }

    /**
     * 写入错误响应
     */
    private void writeError(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(JSON.toJSONString(Result.unauthorized(message)));
    }

    /**
     * 掩码Key（只显示前8位）
     */
    private String maskKey(String key) {
        if (key == null || key.length() <= 8) {
            return "****";
        }
        return key.substring(0, 8) + "****";
    }
}
