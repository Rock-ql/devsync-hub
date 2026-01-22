package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.GitCommit;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

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
}
