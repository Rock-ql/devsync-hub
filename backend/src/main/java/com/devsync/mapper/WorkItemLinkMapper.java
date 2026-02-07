package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.WorkItemLink;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 工作项关联 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface WorkItemLinkMapper extends BaseMapper<WorkItemLink> {

    /**
     * 统计迭代关联的工作项数量
     *
     * @param iterationId 迭代ID
     * @return 工作项数量
     */
    @Select("SELECT COUNT(*) FROM work_item_link WHERE link_type = 'iteration' AND link_id = #{iterationId} AND deleted_at IS NULL")
    Integer countByIterationId(Integer iterationId);

    /**
     * 物理删除需求的关联关系，避免唯一约束冲突
     *
     * @param workItemId 需求ID
     * @return 删除条数
     */
    @Delete("DELETE FROM work_item_link WHERE work_item_id = #{workItemId}")
    int deleteByWorkItemId(@Param("workItemId") Integer workItemId);

    /**
     * 查询被软删除的关联记录（忽略逻辑删除条件）
     *
     * @param workItemId 工作项ID
     * @param linkType   关联类型
     * @param linkId     关联ID
     * @return 关联记录
     */
    @Select("SELECT * FROM work_item_link WHERE work_item_id = #{workItemId} AND link_type = #{linkType} AND link_id = #{linkId} ORDER BY id DESC LIMIT 1")
    WorkItemLink selectOneIncludingDeleted(@Param("workItemId") Integer workItemId,
                                           @Param("linkType") String linkType,
                                           @Param("linkId") Integer linkId);

    /**
     * 恢复被软删除的关联记录（忽略逻辑删除条件）
     *
     * @param id 主键ID
     * @return 更新条数
     */
    @Update("UPDATE work_item_link SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = #{id}")
    int restoreById(@Param("id") Integer id);

    /**
     * 根据关联类型和关联ID查询单条关联记录（用于反向查询SQL已关联的需求）
     *
     * @param linkType 关联类型
     * @param linkId   关联ID
     * @return 关联记录
     */
    @Select("SELECT * FROM work_item_link WHERE link_type = #{linkType} AND link_id = #{linkId} AND deleted_at IS NULL LIMIT 1")
    WorkItemLink selectByLinkTypeAndLinkId(@Param("linkType") String linkType, @Param("linkId") Integer linkId);

    /**
     * 根据关联类型和关联ID列表批量查询关联记录（用于SQL列表填充需求名）
     *
     * @param linkType 关联类型
     * @param linkIds  关联ID列表
     * @return 关联记录列表
     */
    List<WorkItemLink> selectByLinkTypeAndLinkIds(@Param("linkType") String linkType, @Param("linkIds") List<Integer> linkIds);
}
