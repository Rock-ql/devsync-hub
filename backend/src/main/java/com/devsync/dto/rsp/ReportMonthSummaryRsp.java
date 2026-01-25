package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * 报告月度汇总响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "报告月度汇总响应")
public class ReportMonthSummaryRsp {

    @Schema(description = "日报列表")
    private List<DailyReportSummary> dailyReports;

    @Schema(description = "周报列表")
    private List<WeeklyReportSummary> weeklyReports;

    @Data
    @Schema(description = "日报简要信息")
    public static class DailyReportSummary {

        @Schema(description = "日报日期")
        private LocalDate date;

        @Schema(description = "报告ID")
        private Integer id;

        @Schema(description = "标题")
        private String title;
    }

    @Data
    @Schema(description = "周报简要信息")
    public static class WeeklyReportSummary {

        @Schema(description = "第几周（按月统计）")
        private Integer weekNumber;

        @Schema(description = "报告ID")
        private Integer id;

        @Schema(description = "开始日期")
        private LocalDate startDate;

        @Schema(description = "结束日期")
        private LocalDate endDate;
    }
}
