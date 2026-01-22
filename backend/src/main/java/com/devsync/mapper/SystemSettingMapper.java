package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.SystemSetting;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 系统设置 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface SystemSettingMapper extends BaseMapper<SystemSetting> {

    /**
     * 根据设置键查询
     *
     * @param settingKey 设置键
     * @return 设置项
     */
    @Select("SELECT * FROM system_setting WHERE setting_key = #{settingKey} AND deleted_at IS NULL LIMIT 1")
    SystemSetting selectByKey(String settingKey);
}
