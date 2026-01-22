package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 项目实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("project")
public class Project extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 项目名称
     */
    private String name;

    /**
     * 项目描述
     */
    private String description;

    /**
     * GitLab 仓库地址
     */
    private String gitlabUrl;

    /**
     * GitLab Access Token（加密存储）
     */
    private String gitlabToken;

    /**
     * GitLab 项目ID
     */
    private Integer gitlabProjectId;

    /**
     * 默认分支
     */
    private String gitlabBranch;
}
