package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * SQL环境配置响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "SQL环境配置响应")
public class SqlEnvConfigRsp {

    @Schema(description = "环境ID")
    private Integer id;

    @Schema(description = "项目ID")
    private Integer projectId;

    @Schema(description = "环境代码")
    private String envCode;

    @Schema(description = "环境名称")
    private String envName;

    @Schema(description = "排序")
    private Integer sortOrder;
}
