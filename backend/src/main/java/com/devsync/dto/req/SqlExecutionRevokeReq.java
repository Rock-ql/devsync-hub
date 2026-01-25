package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 撤销执行请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "撤销执行请求")
public class SqlExecutionRevokeReq {

    @NotNull(message = "SQL ID不能为空")
    @Schema(description = "SQL ID")
    private Integer sqlId;

    @NotBlank(message = "环境代码不能为空")
    @Schema(description = "环境代码")
    private String env;
}
