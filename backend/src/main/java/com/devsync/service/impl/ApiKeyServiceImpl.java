package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.crypto.SecureUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.common.exception.BusinessException;
import com.devsync.dto.req.ApiKeyCreateReq;
import com.devsync.dto.rsp.ApiKeyRsp;
import com.devsync.entity.ApiKey;
import com.devsync.mapper.ApiKeyMapper;
import com.devsync.service.IApiKeyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * API Key服务实现
 *
 * @author xiaolei
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApiKeyServiceImpl extends ServiceImpl<ApiKeyMapper, ApiKey> implements IApiKeyService {

    private final ApiKeyMapper apiKeyMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApiKeyRsp createApiKey(ApiKeyCreateReq req) {
        log.info("[API Key管理] 创建API Key，名称: {}", req.getName());

        // 生成随机Key
        String keyValue = "dsh_" + UUID.randomUUID().toString().replace("-", "");
        String keyHash = SecureUtil.sha256(keyValue);
        String keyPrefix = keyValue.substring(0, 8);

        ApiKey apiKey = new ApiKey();
        apiKey.setName(req.getName());
        apiKey.setKeyHash(keyHash);
        apiKey.setKeyPrefix(keyPrefix);

        apiKeyMapper.insert(apiKey);
        log.info("[API Key管理] 创建API Key成功，ID: {}", apiKey.getId());

        // 构建响应，包含完整Key
        ApiKeyRsp rsp = new ApiKeyRsp();
        BeanUtil.copyProperties(apiKey, rsp);
        rsp.setFullKey(keyValue);

        return rsp;
    }

    @Override
    public List<ApiKeyRsp> listApiKeys() {
        log.info("[API Key管理] 获取API Key列表");

        LambdaQueryWrapper<ApiKey> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ApiKey::getState, 1)
                .orderByDesc(ApiKey::getCreatedAt);

        List<ApiKey> keys = apiKeyMapper.selectList(wrapper);
        return keys.stream()
                .map(this::convertToRsp)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteApiKey(Integer id) {
        log.info("[API Key管理] 删除API Key，ID: {}", id);

        ApiKey apiKey = apiKeyMapper.selectById(id);
        if (apiKey == null) {
            throw new BusinessException(404, "API Key不存在");
        }

        apiKeyMapper.deleteById(id);
        log.info("[API Key管理] 删除API Key成功，ID: {}", id);
    }

    @Override
    public boolean validateApiKey(String keyValue) {
        if (keyValue == null || keyValue.isEmpty()) {
            return false;
        }

        String keyHash = SecureUtil.sha256(keyValue);
        ApiKey apiKey = apiKeyMapper.selectByKeyHash(keyHash);

        return apiKey != null;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateLastUsedTime(String keyValue) {
        if (keyValue == null || keyValue.isEmpty()) {
            return;
        }

        String keyHash = SecureUtil.sha256(keyValue);
        ApiKey apiKey = apiKeyMapper.selectByKeyHash(keyHash);

        if (apiKey != null) {
            apiKey.setLastUsedAt(LocalDateTime.now());
            apiKeyMapper.updateById(apiKey);
        }
    }

    /**
     * 转换为响应对象
     */
    private ApiKeyRsp convertToRsp(ApiKey apiKey) {
        ApiKeyRsp rsp = new ApiKeyRsp();
        BeanUtil.copyProperties(apiKey, rsp);
        return rsp;
    }
}
