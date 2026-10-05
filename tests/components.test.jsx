import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from '@/components/tables/DataTable';
import { ConfirmDialog } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/Badge';
import { Pagination } from '@/components/common/Controls';

describe('DataTable', () => {
  const columns = [{ key: 'name', header: 'Name', primary: true }, { key: 'phone', header: 'Phone' }];
  it('shows empty, error and row states', () => {
    const { rerender } = render(<DataTable columns={columns} rows={[]} empty={<p>none here</p>} />);
    expect(screen.getByText('none here')).toBeInTheDocument();
    const retry = vi.fn();
    rerender(<DataTable columns={columns} rows={[]} error={{ message: 'Failed to fetch' }} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
    const click = vi.fn();
    rerender(<DataTable columns={columns} rows={[{ id: 1, name: 'John Doe', phone: '0802' }]} onRowClick={click} />);
    fireEvent.click(screen.getAllByText('John Doe')[0]);
    expect(click).toHaveBeenCalledWith({ id: 1, name: 'John Doe', phone: '0802' });
  });
});

describe('ConfirmDialog', () => {
  it('passes the trimmed reason to onConfirm and closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    const onClose = vi.fn();
    render(<ConfirmDialog open title="Cancel delivery?" message="Sure?" withReason confirmLabel="Cancel delivery" onConfirm={onConfirm} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: '  customer asked  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel delivery' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledWith('customer asked');
  });
  it('stays open when the action fails', async () => {
    const onClose = vi.fn();
    render(<ConfirmDialog open title="Go?" message="?" onConfirm={() => Promise.reject(new Error('no'))} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('small components', () => {
  it('labels statuses in user language', () => {
    render(<StatusBadge status="delivered" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
  it('paginates', () => {
    const onChange = vi.fn();
    render(<Pagination page={1} pageSize={10} total={25} onChange={onChange} />);
    expect(screen.getByText('1–10 of 25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
