package com.devsync.service.impl;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.dto.req.SettingUpdateReq;
import com.devsync.entity.SystemSetting;
import com.devsync.mapper.SystemSettingMapper;
import com.devsync.service.ISystemSettingService;
import com.devsync.util.EncryptUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 系统设置服务实现
 *
 * @author xiaolei
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemSettingServiceImpl extends ServiceImpl<SystemSettingMapper, SystemSetting> implements ISystemSettingService {

    private static final String GIT_GITLAB_TOKEN_KEY = "git.gitlab.token";
    private static final String MASKED_CONFIGURED_VALUE = "****已配置";

    private final SystemSettingMapper systemSettingMapper;
    private final EncryptUtil encryptUtil;

    @Override
    public Map<String, String> getAllSettings() {
        log.info("[系统设置] 获取所有设置");

        LambdaQueryWrapper<SystemSetting> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SystemSetting::getState, 1);

        List<SystemSetting> settings = systemSettingMapper.selectList(wrapper);

        Map<String, String> result = new HashMap<>();
        for (SystemSetting setting : settings) {
            if (isGitlabTokenKey(setting.getSettingKey())) {
                result.put(setting.getSettingKey(), StrUtil.isNotBlank(setting.getSettingValue())
                        ? MASKED_CONFIGURED_VALUE
                        : "");
                continue;
            }
            result.put(setting.getSettingKey(), setting.getSettingValue());
        }

        return result;
    }

    @Override
    public String getSetting(String key) {
        log.info("[系统设置] 获取设置，key: {}", key);

        SystemSetting setting = systemSettingMapper.selectByKey(key);
        return setting != null ? setting.getSettingValue() : null;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateSetting(SettingUpdateReq req) {
        log.info("[系统设置] 更新设置，key: {}", req.getSettingKey());

        if (isGitlabTokenKey(req.getSettingKey()) && StrUtil.isNotBlank(req.getSettingValue())) {
            req.setSettingValue(encryptUtil.encrypt(req.getSettingValue()));
        }

        SystemSetting setting = systemSettingMapper.selectByKey(req.getSettingKey());

        if (setting == null) {
            // 新增设置
            setting = new SystemSetting();
            setting.setSettingKey(req.getSettingKey());
            setting.setSettingValue(req.getSettingValue());
            setting.setDescription(req.getDescription());
            systemSettingMapper.insert(setting);
        } else {
            // 更新设置
            setting.setSettingValue(req.getSettingValue());
            if (req.getDescription() != null) {
                setting.setDescription(req.getDescription());
            }
            systemSettingMapper.updateById(setting);
        }

        log.info("[系统设置] 更新设置成功，key: {}", req.getSettingKey());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void batchUpdateSettings(Map<String, String> settings) {
        log.info("[系统设置] 批量更新设置，数量: {}", settings.size());

        for (Map.Entry<String, String> entry : settings.entrySet()) {
            SettingUpdateReq req = new SettingUpdateReq();
            req.setSettingKey(entry.getKey());
            req.setSettingValue(entry.getValue());
            updateSetting(req);
        }

        log.info("[系统设置] 批量更新设置成功");
    }

    private boolean isGitlabTokenKey(String key) {
        return GIT_GITLAB_TOKEN_KEY.equals(key);
    }
}
