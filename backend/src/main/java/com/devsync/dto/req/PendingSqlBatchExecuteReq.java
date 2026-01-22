package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/**
 * SQL批量执行请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "SQL批量执行请求")
public class PendingSqlBatchExecuteReq {

    @NotEmpty(message = "SQL ID列表不能为空")
    @Schema(description = "SQL ID列表")
    private List<Integer> ids;

    @NotBlank(message = "执行环境不能为空")
    @Schema(description = "执行环境（如：local/dev/test/prod）")
    private String executedEnv;
}
