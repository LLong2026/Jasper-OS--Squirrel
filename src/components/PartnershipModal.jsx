import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PartnershipModal({ isOpen, onOpenChange, onSave, partnership }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    setFormData(partnership || { status: 'Prospect' });
  }, [partnership]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>{partnership ? 'Edit Partnership' : 'New Partnership Prospect'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="institution" className="text-right">Institution</Label>
            <Input id="institution" value={formData.institution || ''} onChange={(e) => handleChange('institution', e.target.value)} className="col-span-3 bg-slate-800 border-slate-600" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="researchArea" className="text-right">Research Area</Label>
            <Input id="researchArea" value={formData.researchArea || ''} onChange={(e) => handleChange('researchArea', e.target.value)} className="col-span-3 bg-slate-800 border-slate-600" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">Status</Label>
            <Select onValueChange={(value) => handleChange('status', value)} value={formData.status}>
              <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 text-white">
                <SelectItem value="Prospect">Prospect</SelectItem>
                <SelectItem value="Contacted">Contacted</SelectItem>
                <SelectItem value="In Discussion">In Discussion</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="valueToPartner" className="text-right">Value To Them</Label>
            <Textarea id="valueToPartner" value={formData.valueToPartner || ''} onChange={(e) => handleChange('valueToPartner', e.target.value)} className="col-span-3 bg-slate-800 border-slate-600" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="resourcesFromPartner" className="text-right">Resources We Need</Label>
            <Textarea id="resourcesFromPartner" value={formData.resourcesFromPartner || ''} onChange={(e) => handleChange('resourcesFromPartner', e.target.value)} className="col-span-3 bg-slate-800 border-slate-600" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">Notes</Label>
            <Textarea id="notes" value={formData.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} className="col-span-3 bg-slate-800 border-slate-600" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}