package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * SQL环境执行状态
 *
 * @author xiaolei
 */
@Data
@Schema(description = "SQL环境执行状态")
public class PendingSqlEnvExecutionRsp {

    @Schema(description = "环境代码")
    private String envCode;

    @Schema(description = "环境名称")
    private String envName;

    @Schema(description = "是否已执行")
    private Boolean executed;

    @Schema(description = "执行时间")
    private LocalDateTime executedAt;

    @Schema(description = "执行人")
    private String executor;

    @Schema(description = "执行备注")
    private String remark;
}
