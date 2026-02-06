package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.GitCommit;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Git提交记录 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface GitCommitMapper extends BaseMapper<GitCommit> {

    /**
     * 插入提交记录，若已存在则忽略（避免唯一索引冲突导致事务中断）
     *
     * @param commit 提交记录
     * @return 影响行数（1=新增，0=已存在）
     */
    @Insert("INSERT INTO git_commit (project_id, commit_id, message, author_name, author_email, committed_at, additions, deletions, branch) " +
            "VALUES (#{projectId}, #{commitId}, #{message}, COALESCE(#{authorName}, ''), COALESCE(#{authorEmail}, ''), " +
            "#{committedAt}, COALESCE(#{additions}, 0), COALESCE(#{deletions}, 0), COALESCE(#{branch}, '')) " +
            "ON CONFLICT (project_id, commit_id) DO NOTHING")
    int insertIgnoreConflict(GitCommit commit);

    /**
     * 合并更新分支信息（已存在记录时补充分支）
     *
     * @param projectId 项目ID
     * @param commitId  提交ID
     * @param branch    分支信息（可为逗号分隔）
     * @return 影响行数
     */
    @Update("UPDATE git_commit SET " +
            "branch = CASE " +
            "WHEN COALESCE(branch, '') = '' THEN #{branch} " +
            "WHEN COALESCE(#{branch}, '') = '' THEN branch " +
            "WHEN POSITION(#{branch} IN branch) > 0 THEN branch " +
            "ELSE branch || ',' || #{branch} END, " +
            "updated_at = NOW() " +
            "WHERE project_id = #{projectId} AND commit_id = #{commitId} AND deleted_at IS NULL")
    int mergeBranch(@Param("projectId") Integer projectId,
                    @Param("commitId") String commitId,
                    @Param("branch") String branch);

    /**
     * 查询指定时间范围内的提交记录
     *
     * @param projectId 项目ID
     * @param startTime 开始时间
     * @param endTime   结束时间
     * @return 提交记录列表
     */
    @Select("SELECT * FROM git_commit WHERE project_id = #{projectId} " +
            "AND committed_at >= #{startTime} AND committed_at <= #{endTime} " +
            "AND deleted_at IS NULL ORDER BY committed_at DESC")
    List<GitCommit> selectByTimeRange(Integer projectId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 查询所有项目指定时间范围内的提交记录
     *
     * @param startTime 开始时间
     * @param endTime   结束时间
     * @return 提交记录列表
     */
    @Select("SELECT * FROM git_commit WHERE committed_at >= #{startTime} " +
            "AND committed_at <= #{endTime} AND deleted_at IS NULL ORDER BY committed_at DESC")
    List<GitCommit> selectAllByTimeRange(LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 查询指定时间范围内指定作者的提交记录
     *
     * @param projectId   项目ID
     * @param startTime   开始时间
     * @param endTime     结束时间
     * @param authorEmail 作者邮箱
     * @return 提交记录列表
     */
    @Select("SELECT * FROM git_commit WHERE project_id = #{projectId} " +
            "AND committed_at >= #{startTime} AND committed_at <= #{endTime} " +
            "AND author_email = #{authorEmail} AND deleted_at IS NULL ORDER BY committed_at DESC")
    List<GitCommit> selectByTimeRangeAndAuthor(Integer projectId, LocalDateTime startTime,
                                                LocalDateTime endTime, String authorEmail);

    /**
     * 查询所有项目指定时间范围内指定作者的提交记录
     *
     * @param startTime   开始时间
     * @param endTime     结束时间
     * @param authorEmail 作者邮箱
     * @return 提交记录列表
     */
    @Select("SELECT * FROM git_commit WHERE committed_at >= #{startTime} " +
            "AND committed_at <= #{endTime} AND author_email = #{authorEmail} " +
            "AND deleted_at IS NULL ORDER BY committed_at DESC")
    List<GitCommit> selectAllByTimeRangeAndAuthor(LocalDateTime startTime, LocalDateTime endTime,
                                                   String authorEmail);
}
