package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 需求响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "需求响应")
public class RequirementRsp {

    @Schema(description = "需求ID")
    private Integer id;

    @Schema(description = "需求名称")
    private String name;

    @Schema(description = "需求链接")
    private String link;

    @Schema(description = "归属迭代ID")
    private Integer iterationId;

    @Schema(description = "需求状态")
    private String status;

    @Schema(description = "需求状态描述")
    private String statusDesc;

    @Schema(description = "关联项目ID列表")
    private List<Integer> projectIds;

    @Schema(description = "关联项目名称列表")
    private List<String> projectNames;

    @Schema(description = "关联SQL数量")
    private Integer linkedSqlCount;

    @Schema(description = "关联提交数量")
    private Integer linkedCommitCount;

    @Schema(description = "关联Git分支名称")
    private String branch;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}
