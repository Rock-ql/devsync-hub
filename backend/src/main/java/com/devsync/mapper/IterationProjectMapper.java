package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.IterationProject;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 迭代-项目关联 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface IterationProjectMapper extends BaseMapper<IterationProject> {

    /**
     * 物理删除迭代的项目关联关系，避免唯一约束冲突
     *
     * @param iterationId 迭代ID
     * @return 删除条数
     */
    @Delete("DELETE FROM iteration_project WHERE iteration_id = #{iterationId}")
    int deleteByIterationId(Integer iterationId);

    /**
     * 查询项目关联的迭代ID列表
     *
     * @param projectId 项目ID
     * @return 迭代ID列表
     */
    @Select("SELECT iteration_id FROM iteration_project WHERE project_id = #{projectId} AND deleted_at IS NULL")
    List<Integer> selectIterationIdsByProjectId(Integer projectId);
}

