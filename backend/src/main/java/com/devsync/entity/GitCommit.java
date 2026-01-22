package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * Git提交记录缓存实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("git_commit")
public class GitCommit extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 关联项目ID
     */
    private Integer projectId;

    /**
     * 提交ID
     */
    private String commitId;

    /**
     * 提交信息
     */
    private String message;

    /**
     * 作者名称
     */
    private String authorName;

    /**
     * 作者邮箱
     */
    private String authorEmail;

    /**
     * 提交时间
     */
    private LocalDateTime committedAt;

    /**
     * 新增行数
     */
    private Integer additions;

    /**
     * 删除行数
     */
    private Integer deletions;
}
