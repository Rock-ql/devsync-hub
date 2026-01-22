package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * SQL列表请求
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Schema(description = "SQL列表请求")
public class PendingSqlListReq extends PageReq {

    @Schema(description = "项目ID")
    private Integer projectId;

    @Schema(description = "迭代ID")
    private Integer iterationId;

    @Schema(description = "标题（模糊搜索）")
    private String title;

    @Schema(description = "状态: pending/executed")
    private String status;
}
