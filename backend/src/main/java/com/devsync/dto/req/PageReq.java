package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * 分页请求基类
 *
 * @author xiaolei
 */
@Data
@Schema(description = "分页请求基类")
public class PageReq {

    @Schema(description = "页码，默认1", example = "1")
    private Integer pageNum = 1;

    @Schema(description = "每页大小，默认10", example = "10")
    private Integer pageSize = 10;

    /**
     * 获取偏移量
     */
    public int getOffset() {
        return (pageNum - 1) * pageSize;
    }
}
