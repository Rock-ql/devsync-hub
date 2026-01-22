package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.ApiKey;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * API Key Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface ApiKeyMapper extends BaseMapper<ApiKey> {

    /**
     * 根据Key哈希值查询
     *
     * @param keyHash Key哈希值
     * @return ApiKey
     */
    @Select("SELECT * FROM api_key WHERE key_hash = #{keyHash} AND state = 1 AND deleted_at IS NULL")
    ApiKey selectByKeyHash(String keyHash);
}
