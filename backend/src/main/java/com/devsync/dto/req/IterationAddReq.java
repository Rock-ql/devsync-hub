package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

/**
 * 迭代新增请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "迭代新增请求")
public class IterationAddReq {

    @NotNull(message = "项目ID不能为空")
    @Schema(description = "项目ID")
    private Integer projectId;

    @NotBlank(message = "迭代名称不能为空")
    @Size(max = 100, message = "迭代名称不能超过100个字符")
    @Schema(description = "迭代名称")
    private String name;

    @Size(max = 1000, message = "迭代描述不能超过1000个字符")
    @Schema(description = "迭代描述")
    private String description;

    @Schema(description = "状态: planning/developing/testing/released")
    private String status;

    @Schema(description = "计划开始日期")
    private LocalDate startDate;

    @Schema(description = "计划结束日期")
    private LocalDate endDate;
}
