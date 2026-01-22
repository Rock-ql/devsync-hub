package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * SQL更新请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "SQL更新请求")
public class PendingSqlUpdateReq {

    @NotNull(message = "SQL ID不能为空")
    @Schema(description = "SQL ID")
    private Integer id;

    @Schema(description = "迭代ID")
    private Integer iterationId;

    @Size(max = 200, message = "SQL标题不能超过200个字符")
    @Schema(description = "SQL标题")
    private String title;

    @Schema(description = "SQL内容")
    private String content;

    @Schema(description = "执行顺序")
    private Integer executionOrder;

    @Size(max = 1000, message = "备注不能超过1000个字符")
    @Schema(description = "备注")
    private String remark;
}
