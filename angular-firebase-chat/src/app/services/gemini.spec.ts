import { TestBed } from '@angular/core/testing';

import { Gemini } from './openai';

describe('Gemini', () => {
  let service: Gemini;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Gemini);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
