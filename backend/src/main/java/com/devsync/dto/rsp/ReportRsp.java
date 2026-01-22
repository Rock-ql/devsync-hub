package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 报告详情响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "报告详情响应")
public class ReportRsp {

    @Schema(description = "报告ID")
    private Integer id;

    @Schema(description = "报告类型: daily/weekly")
    private String type;

    @Schema(description = "类型描述")
    private String typeDesc;

    @Schema(description = "标题")
    private String title;

    @Schema(description = "Markdown内容")
    private String content;

    @Schema(description = "开始日期")
    private LocalDate startDate;

    @Schema(description = "结束日期")
    private LocalDate endDate;

    @Schema(description = "提交记录摘要")
    private Map<String, Object> commitSummary;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
