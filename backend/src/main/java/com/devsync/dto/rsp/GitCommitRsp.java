package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Git提交记录响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "Git提交记录响应")
public class GitCommitRsp {

    @Schema(description = "ID")
    private Integer id;

    @Schema(description = "提交ID")
    private String commitId;

    @Schema(description = "提交信息")
    private String message;

    @Schema(description = "作者名称")
    private String authorName;

    @Schema(description = "作者邮箱")
    private String authorEmail;

    @Schema(description = "提交时间")
    private LocalDateTime committedAt;

    @Schema(description = "新增行数")
    private Integer additions;

    @Schema(description = "删除行数")
    private Integer deletions;
}
