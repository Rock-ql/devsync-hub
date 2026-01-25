package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.SqlExecutionLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * SQL执行记录 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface SqlExecutionLogMapper extends BaseMapper<SqlExecutionLog> {

    /**
     * 批量统计SQL执行次数
     */
    @Select({
            "<script>",
            "SELECT sql_id AS sqlId, COUNT(*) AS count",
            "FROM sql_execution_log",
            "WHERE deleted_at IS NULL",
            "<if test='sqlIds != null and sqlIds.size > 0'>",
            "  AND sql_id IN",
            "  <foreach collection='sqlIds' item='id' open='(' separator=',' close=')'>",
            "    #{id}",
            "  </foreach>",
            "</if>",
            "GROUP BY sql_id",
            "</script>"
    })
    List<SqlExecutionCount> countBySqlIds(@Param("sqlIds") List<Integer> sqlIds);

    /**
     * 按项目和环境软删除执行记录
     */
    @Update({
            "UPDATE sql_execution_log",
            "SET deleted_at = NOW(), updated_at = NOW()",
            "WHERE deleted_at IS NULL",
            "  AND env = #{envCode}",
            "  AND sql_id IN (",
            "    SELECT id FROM pending_sql",
            "    WHERE project_id = #{projectId} AND deleted_at IS NULL",
            "  )"
    })
    int softDeleteByProjectAndEnv(@Param("projectId") Integer projectId,
                                  @Param("envCode") String envCode);
}
