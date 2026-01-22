package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 报告更新请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "报告更新请求")
public class ReportUpdateReq {

    @NotNull(message = "报告ID不能为空")
    @Schema(description = "报告ID")
    private Integer id;

    @Size(max = 200, message = "标题不能超过200个字符")
    @Schema(description = "标题")
    private String title;

    @Schema(description = "Markdown内容")
    private String content;
}
