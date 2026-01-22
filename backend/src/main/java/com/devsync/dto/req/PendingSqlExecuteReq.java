package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * SQL执行请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "SQL执行请求")
public class PendingSqlExecuteReq {

    @NotNull(message = "SQL ID不能为空")
    @Schema(description = "SQL ID")
    private Integer id;

    @NotBlank(message = "执行环境不能为空")
    @Schema(description = "执行环境（如：local/dev/test/prod）")
    private String executedEnv;
}
