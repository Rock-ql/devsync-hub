package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 删除环境请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "删除环境请求")
public class SqlEnvDeleteReq {

    @NotNull(message = "项目ID不能为空")
    @Schema(description = "项目ID")
    private Integer projectId;

    @NotBlank(message = "环境代码不能为空")
    @Schema(description = "环境代码")
    private String envCode;
}
