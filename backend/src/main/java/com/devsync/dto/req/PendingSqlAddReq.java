package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * SQL新增请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "SQL新增请求")
public class PendingSqlAddReq {

    @NotNull(message = "项目ID不能为空")
    @Schema(description = "项目ID")
    private Integer projectId;

    @Schema(description = "迭代ID")
    private Integer iterationId;

    @NotBlank(message = "SQL标题不能为空")
    @Size(max = 200, message = "SQL标题不能超过200个字符")
    @Schema(description = "SQL标题")
    private String title;

    @NotBlank(message = "SQL内容不能为空")
    @Schema(description = "SQL内容")
    private String content;

    @Schema(description = "执行顺序")
    private Integer executionOrder;

    @Size(max = 1000, message = "备注不能超过1000个字符")
    @Schema(description = "备注")
    private String remark;
}
