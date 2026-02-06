package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

/**
 * 报告生成请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "报告生成请求")
public class ReportGenerateReq {

    @NotBlank(message = "报告类型不能为空")
    @Schema(description = "报告类型: daily/weekly")
    private String type;

    @NotNull(message = "开始日期不能为空")
    @Schema(description = "开始日期")
    private LocalDate startDate;

    @NotNull(message = "结束日期不能为空")
    @Schema(description = "结束日期")
    private LocalDate endDate;

    @Schema(description = "模板ID（可选，不传则使用默认模板）")
    private Integer templateId;

    @Schema(description = "作者邮箱（可选，不传则使用系统设置中的邮箱，留空获取所有人的提交）")
    private String authorEmail;
}
