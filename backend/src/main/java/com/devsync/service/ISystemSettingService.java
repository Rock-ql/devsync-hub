package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.dto.req.SettingUpdateReq;
import com.devsync.entity.SystemSetting;

import java.util.Map;

/**
 * 系统设置服务接口
 *
 * @author xiaolei
 */
public interface ISystemSettingService extends IService<SystemSetting> {

    /**
     * 获取所有设置
     *
     * @return 设置Map
     */
    Map<String, String> getAllSettings();

    /**
     * 获取单个设置
     *
     * @param key 设置键
     * @return 设置值
     */
    String getSetting(String key);

    /**
     * 更新设置
     *
     * @param req 更新请求
     */
    void updateSetting(SettingUpdateReq req);

    /**
     * 批量更新设置
     *
     * @param settings 设置Map
     */
    void batchUpdateSettings(Map<String, String> settings);
}
