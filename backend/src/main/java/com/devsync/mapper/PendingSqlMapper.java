package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.PendingSql;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 待执行SQL Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface PendingSqlMapper extends BaseMapper<PendingSql> {

    /**
     * 统计项目的待执行SQL数量
     *
     * @param projectId 项目ID
     * @return 待执行SQL数量
     */
    @Select({
            "SELECT COUNT(*) FROM pending_sql ps",
            "LEFT JOIN (",
            "  SELECT sql_id, COUNT(*) AS executed_count",
            "  FROM sql_execution_log",
            "  WHERE deleted_at IS NULL",
            "  GROUP BY sql_id",
            ") log ON log.sql_id = ps.id",
            "WHERE ps.project_id = #{projectId}",
            "  AND ps.deleted_at IS NULL",
            "  AND COALESCE(log.executed_count, 0) = 0"
    })
    Integer countPendingByProjectId(Integer projectId);

    /**
     * 统计迭代的待执行SQL数量
     *
     * @param iterationId 迭代ID
     * @return 待执行SQL数量
     */
    @Select({
            "SELECT COUNT(*) FROM pending_sql ps",
            "LEFT JOIN (",
            "  SELECT sql_id, COUNT(*) AS executed_count",
            "  FROM sql_execution_log",
            "  WHERE deleted_at IS NULL",
            "  GROUP BY sql_id",
            ") log ON log.sql_id = ps.id",
            "WHERE ps.iteration_id = #{iterationId}",
            "  AND ps.deleted_at IS NULL",
            "  AND COALESCE(log.executed_count, 0) = 0"
    })
    Integer countPendingByIterationId(Integer iterationId);

    /**
     * 统计所有待执行SQL数量
     */
    @Select({
            "SELECT COUNT(*) FROM pending_sql ps",
            "LEFT JOIN (",
            "  SELECT sql_id, COUNT(*) AS executed_count",
            "  FROM sql_execution_log",
            "  WHERE deleted_at IS NULL",
            "  GROUP BY sql_id",
            ") log ON log.sql_id = ps.id",
            "WHERE ps.deleted_at IS NULL",
            "  AND COALESCE(log.executed_count, 0) = 0"
    })
    Integer countPendingAll();

    /**
     * 按项目统计待执行SQL数量
     */
    @Select({
            "SELECT ps.project_id AS projectId, COUNT(*) AS count",
            "FROM pending_sql ps",
            "LEFT JOIN (",
            "  SELECT sql_id, COUNT(*) AS executed_count",
            "  FROM sql_execution_log",
            "  WHERE deleted_at IS NULL",
            "  GROUP BY sql_id",
            ") log ON log.sql_id = ps.id",
            "WHERE ps.deleted_at IS NULL",
            "  AND COALESCE(log.executed_count, 0) = 0",
            "GROUP BY ps.project_id"
    })
    List<ProjectPendingCount> countPendingGroupByProject();

    /**
     * 获取项目的下一个执行顺序号
     *
     * @param projectId 项目ID
     * @return 下一个执行顺序号
     */
    @Select("SELECT COALESCE(MAX(execution_order), 0) + 1 FROM pending_sql WHERE project_id = #{projectId} AND deleted_at IS NULL")
    Integer getNextExecutionOrder(Integer projectId);
}
