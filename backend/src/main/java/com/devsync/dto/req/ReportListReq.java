package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 报告列表请求
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Schema(description = "报告列表请求")
public class ReportListReq extends PageReq {

    @Schema(description = "报告类型: daily/weekly")
    private String type;
}
