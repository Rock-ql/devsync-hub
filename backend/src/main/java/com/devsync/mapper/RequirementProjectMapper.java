package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.RequirementProject;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;

/**
 * 需求-项目关联 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface RequirementProjectMapper extends BaseMapper<RequirementProject> {

    /**
     * 物理删除需求的项目关联关系，避免唯一约束冲突
     *
     * @param requirementId 需求ID
     * @return 删除条数
     */
    @Delete("DELETE FROM requirement_project WHERE requirement_id = #{requirementId}")
    int deleteByRequirementId(Integer requirementId);
}
