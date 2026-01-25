package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 报告月度汇总请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "报告月度汇总请求")
public class ReportMonthSummaryReq {

    @NotNull(message = "年份不能为空")
    @Min(value = 1970, message = "年份不能小于1970")
    @Schema(description = "年份")
    private Integer year;

    @NotNull(message = "月份不能为空")
    @Min(value = 1, message = "月份不能小于1")
    @Max(value = 12, message = "月份不能大于12")
    @Schema(description = "月份")
    private Integer month;
}
