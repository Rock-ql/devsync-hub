package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * SQL环境配置实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sql_env_config")
public class SqlEnvConfig extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 关联项目ID
     */
    private Integer projectId;

    /**
     * 环境代码
     */
    private String envCode;

    /**
     * 环境名称
     */
    private String envName;

    /**
     * 排序
     */
    private Integer sortOrder;
}
