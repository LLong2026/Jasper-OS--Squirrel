import React, { useState, useEffect, useCallback } from 'react';
import { Partnership } from '@/entities/Partnership';
import PartnershipModal from '@/components/PartnershipModal';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical } from 'lucide-react';

const statusColumns = {
  'Prospect': { name: 'Prospects', color: 'bg-slate-700' },
  'Contacted': { name: 'Contacted', color: 'bg-blue-900/50' },
  'In Discussion': { name: 'In Discussion', color: 'bg-purple-900/50' },
  'Active': { name: 'Active Partnerships', color: 'bg-green-900/50' },
};

const PartnershipCard = ({ item, index, onEdit }) => (
  <Draggable draggableId={item.id.toString()} index={index}>
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        className={`bg-slate-800/80 rounded-lg p-4 mb-3 border border-slate-700 hover:bg-slate-700/80 transition-colors ${snapshot.isDragging ? 'shadow-2xl shadow-blue-500/50' : ''}`}
      >
        <div className="flex justify-between items-start">
            <div onClick={() => onEdit(item)} className="cursor-pointer flex-grow">
                <h4 className="font-bold text-white mb-1">{item.institution}</h4>
                <p className="text-sm text-slate-300 font-medium">{item.researchArea}</p>
                <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400 space-y-2">
                    <p><span className="font-semibold text-slate-300">Value ➔</span> {item.valueToPartner}</p>
                    <p><span className="font-semibold text-slate-300">Needs ➔</span> {item.resourcesFromPartner}</p>
                </div>
            </div>
            <div {...provided.dragHandleProps} className="p-2 -mt-2 -mr-2 text-slate-500 hover:text-white">
                <GripVertical className="w-5 h-5" />
            </div>
        </div>
      </div>
    )}
  </Draggable>
);

export default function PartnershipsPage() {
  const [partnerships, setPartnerships] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartnership, setEditingPartnership] = useState(null);

  const loadPartnerships = useCallback(async () => {
    const items = await Partnership.list('-updated_date');
    setPartnerships(items);
  }, []);

  useEffect(() => {
    loadPartnerships();
  }, [loadPartnerships]);

  const handleSave = async (partnershipData) => {
    if (partnershipData.id) {
      await Partnership.update(partnershipData.id, partnershipData);
    } else {
      await Partnership.create(partnershipData);
    }
    loadPartnerships();
    setEditingPartnership(null);
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    const movedPartnership = partnerships.find(p => p.id === draggableId);
    if (movedPartnership && movedPartnership.status !== destination.droppableId) {
        // Optimistically update UI
        setPartnerships(prev => prev.map(p => p.id === draggableId ? {...p, status: destination.droppableId} : p));
        // Update backend
        await Partnership.update(draggableId, { status: destination.droppableId });
    }
  };

  const openModalForEdit = (partnership) => {
    setEditingPartnership(partnership);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 h-screen flex flex-col">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Strategic Research Partnerships</h1>
        <Button onClick={() => { setEditingPartnership(null); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> New Prospect
        </Button>
      </header>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
          {Object.entries(statusColumns).map(([statusId, column]) => (
            <div key={statusId} className={`rounded-xl h-full flex flex-col ${column.color}`}>
              <h3 className="text-lg font-semibold p-4 text-white border-b border-white/10">{column.name}</h3>
              <Droppable droppableId={statusId}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-4 flex-1 overflow-y-auto transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                  >
                    {partnerships.filter(p => p.status === statusId).map((p, index) => (
                      <PartnershipCard key={p.id} item={p} index={index} onEdit={openModalForEdit} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <PartnershipModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSave={handleSave}
        partnership={editingPartnership}
      />
    </div>
  );
}