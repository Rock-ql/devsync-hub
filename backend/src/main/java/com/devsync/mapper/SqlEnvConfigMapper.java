package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.SqlEnvConfig;
import org.apache.ibatis.annotations.Mapper;

/**
 * SQL环境配置 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface SqlEnvConfigMapper extends BaseMapper<SqlEnvConfig> {
}
