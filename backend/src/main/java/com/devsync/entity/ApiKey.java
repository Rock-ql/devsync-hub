package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * API Key实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("api_key")
public class ApiKey extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * Key名称
     */
    private String name;

    /**
     * Key哈希值
     */
    private String keyHash;

    /**
     * 显示前缀
     */
    private String keyPrefix;

    /**
     * 最后使用时间
     */
    private LocalDateTime lastUsedAt;
}
